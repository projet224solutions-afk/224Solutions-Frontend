/**
 * ADD SERVICE MODAL
 * Permet au vendeur de créer un nouveau service professionnel
 * Ex: Restaurant, Boutique en ligne, Salon de beauté, etc.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Store, Utensils, Scissors, Car, Heart,
  BookOpen, Camera, Truck, Building2, Dumbbell,
  Laptop, Leaf, Hammer, Sparkles, ArrowRight,
  Loader2, CheckCircle, AlertCircle, MapPin, Navigation,
  Home, Plane, Briefcase, Wrench, Square, Flame
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  is_active: boolean;
}

interface AddServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mapping des icônes - 18 services synchronisés avec Auth.tsx et service_types DB
const SERVICE_ICONS: Record<string, React.ElementType> = {
  // Services de Proximité Populaires
  restaurant: Utensils,
  beaute: Scissors,
  vtc: Car,
  reparation: Hammer,
  menage: Sparkles,
  informatique: Laptop,
  // Services Professionnels
  sport: Dumbbell,
  location: Building2,
  media: Camera,
  construction: Hammer,
  plomberie: Wrench,
  vitrerie: Square,
  menuiserie: Hammer,
  soudure: Flame,
  agriculture: Leaf,
  freelance: Briefcase,
  sante: Heart,
  maison: Home,
  // Autres Services
  education: BookOpen,
  livraison: Truck,
  voyage: Plane,
  ecommerce: Store,
  // Default
  default: Store
};

// Schéma de validation Zod
const serviceFormSchema = z.object({
  businessName: z
    .string()
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .regex(
      /^[a-zA-Z0-9\sÀ-ÿ\-'&.]+$/,
      'Le nom contient des caractères non autorisés'
    )
    .transform(val => val.trim()),
  description: z
    .string()
    .max(500, 'La description ne peut pas dépasser 500 caractères')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .max(200, 'L\'adresse ne peut pas dépasser 200 caractères')
    .optional()
    .or(z.literal(''))
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

export function AddServiceModal({ open, onOpenChange }: AddServiceModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchServiceTypes();
      setStep('select');
      setSelectedType(null);
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setBusinessName('');
    setDescription('');
    setAddress('');
    setLatitude(null);
    setLongitude(null);
    setGpsError(null);
  };

  // Fonction pour obtenir la position GPS
  const getGpsLocation = async () => {
    if (!navigator.geolocation) {
      setGpsError('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGpsLoading(false);
        toast.success(t('addServiceModal.positionGpsCaptureeAvecSucces'));
      },
      (error) => {
        setGpsLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Vous avez refusé l\'accès à votre position');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Position non disponible');
            break;
          case error.TIMEOUT:
            setGpsError('Délai d\'attente dépassé');
            break;
          default:
            setGpsError('Erreur lors de la récupération de la position');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const fetchServiceTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error fetching service types:', error);
      toast.error(t('addServiceModal.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectType = (type: ServiceType) => {
    setSelectedType(type);
    setStep('configure');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedType(null);
    resetForm();
  };

  const handleCreate = async () => {
    if (!user?.id || !selectedType) {
      toast.error(t('addServiceModal.sessionExpireeVeuillezVousReconnecter'));
      return;
    }

    // Validation avec Zod
    try {
      const formData: ServiceFormData = {
        businessName,
        description,
        address
      };

      const validatedData = serviceFormSchema.parse(formData);

      setCreating(true);

      // Créer le nouveau service professionnel avec données validées
      const { data, error } = await supabase
        .from('professional_services')
        .insert({
          user_id: user.id,
          service_type_id: selectedType.id,
          business_name: validatedData.businessName,
          description: validatedData.description || null,
          address: validatedData.address || null,
          latitude: latitude,
          longitude: longitude,
          status: 'active',
          verification_status: 'unverified',
          rating: 0,
          total_reviews: 0
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('addServiceModal.serviceCreeAvecSucces'));
      onOpenChange(false);

      // Rediriger vers la page vendeur pour voir le nouveau service
      navigate('/vendeur', {
        state: {
          newServiceId: data.id,
          showServiceModule: true
        }
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        // Erreur de validation Zod - utiliser .issues pour Zod v4+
        const firstError = error.issues[0];
        toast.error(firstError.message);
      } else if (error.code === '23505') {
        toast.error(t('addServiceModal.vousAvezDejaUnService'));
      } else {
        console.error('Error creating service:', error);
        toast.error(t('addServiceModal.erreurLorsDeLaCreation'));
      }
    } finally {
      setCreating(false);
    }
  };

  const getServiceIcon = (code: string) => {
    return SERVICE_ICONS[code] || SERVICE_ICONS.default;
  };

  // Services IDENTIQUES à Auth.tsx - Synchronisation complète
  const DISPLAY_SERVICES = {
    // Services de Proximité Populaires (6) - Identique à Auth.tsx
    proximity: [
      { code: 'restaurant', name: 'Restaurant', logoImage: '/service-icons-3d/restaurant.png', icon: '🍽️', desc: 'Cuisine & plats' },
      { code: 'beaute', name: 'Beauté & Coiffure', logoImage: '/service-icons-3d/beaute.png', icon: '💇', desc: 'Soins & styling' },
      { code: 'vtc', name: 'Transport VTC', logoImage: '/service-icons-3d/vtc.png', icon: '🚗', desc: 'Véhicules privés' },
      { code: 'reparation', name: 'Réparation', logoImage: '/service-icons-3d/reparation.png', icon: '🔧', desc: 'Électro & mécanique' },
      { code: 'menage', name: 'Nettoyage', logoImage: '/service-icons-3d/nettoyage.png', icon: '✨', desc: 'Ménage & pressing' },
      { code: 'informatique', name: 'Informatique', logoImage: '/service-icons-3d/informatique.png', icon: '💻', desc: 'Tech & dépannage' },
    ],
    // Services Professionnels (8) - Identique à Auth.tsx
    professional: [
      { code: 'sport', name: 'Sport & Fitness', logoImage: '/service-icons-3d/sport.png', icon: '🏋️', desc: 'Coaching' },
      { code: 'location', name: 'Immobilier', logoImage: '/service-icons-3d/immobilier.png', icon: '🏢', desc: 'Location & vente' },
      { code: 'media', name: 'Photo & Vidéo', logoImage: '/service-icons-3d/media.png', icon: '📸', desc: 'Événements' },
      { code: 'construction', name: 'Construction & BTP', logoImage: '/service-icons-3d/construction.png', icon: '🏗️', desc: 'Bâtiment' },
      { code: 'plomberie', name: 'Plomberie', logoImage: '/service-icons-3d/plomberie.png', icon: '🔧', desc: 'Sanitaires & urgence' },
      { code: 'vitrerie', name: 'Vitrerie', logoImage: '/service-icons-3d/vitrerie.png', icon: '🪟', desc: 'Vitres & miroirs' },
      { code: 'menuiserie', name: 'Menuiserie', logoImage: '/service-icons-3d/menuiserie.png', icon: '🪚', desc: 'Bois sur mesure' },
      { code: 'soudure', name: 'Soudure & Métallerie', logoImage: '/service-icons-3d/soudure.png', icon: '🔥', desc: 'Métal & ferronnerie' },
      { code: 'agriculture', name: 'Agriculture', logoImage: '/service-icons-3d/agriculture.png', icon: '🌾', desc: 'Produits locaux' },
      { code: 'freelance', name: 'Administratif', logoImage: '/service-icons-3d/freelance.png', icon: '💼', desc: 'Secrétariat' },
      { code: 'sante', name: 'Santé & Bien-être', logoImage: '/service-icons-3d/sante.png', icon: '💊', desc: 'Pharmacie & soins' },
      { code: 'maison', name: 'Maison & Déco', logoImage: '/service-icons-3d/maison.png', icon: '🏠', desc: 'Intérieur' },
    ],
    // Autres Services (4) - Identique à Auth.tsx
    other: [
      { code: 'education', name: 'Formation', icon: '🎓', desc: 'Cours et coaching' },
      { code: 'livraison', name: 'Livraison', logoImage: '/service-icons-3d/livraison.png', icon: '🚚', desc: 'Coursier & colis' },
      { code: 'voyage', name: 'Voyage', icon: '✈️', desc: 'Tourisme et voyages' },
      { code: 'ecommerce', name: 'Boutique', logoImage: '/service-icons-3d/boutique.png', icon: '🏪', desc: 'E-commerce' },
    ]
  };

  const getServiceTypeByCode = (code: string) => {
    return serviceTypes.find(type => type.code === code);
  };

  const renderDisplayServiceCard = (displayService: { code: string; name: string; icon: string; logoImage?: string; desc: string }, colorClass: string, borderClass: string) => {
    const dbService = getServiceTypeByCode(displayService.code);
    if (!dbService) return null;

    return (
      <button
        key={displayService.code}
        onClick={() => handleSelectType(dbService)}
        className={`flex flex-col items-center p-3 bg-gradient-to-br ${colorClass} rounded-xl border-2 hover:shadow-lg hover:scale-[1.02] transition-all ${borderClass}`}
      >
        {displayService.logoImage ? (
          <div className="h-12 w-12 overflow-hidden rounded-xl mb-1.5 shadow-sm">
            <img src={displayService.logoImage} alt={displayService.name} className="h-full w-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="text-3xl mb-1.5">{displayService.icon}</div>
        )}
        <span className="text-sm font-semibold text-foreground">{displayService.name}</span>
        <span className="text-[10px] text-muted-foreground">{displayService.desc}</span>
      </button>
    );
  };

  const renderServiceTypeGrid = () => (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-6">
        {/* Section: Services de Proximité Populaires - Identique à Auth.tsx */}
        <div>
          <h4 className="text-sm font-semibold text-primary mb-3 flex items-center justify-center gap-2">
            <span className="w-8 h-0.5 bg-primary rounded"></span>
            Services de Proximité Populaires
            <span className="w-8 h-0.5 bg-primary rounded"></span>
          </h4>
          {/* Première ligne - 4 boutons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {DISPLAY_SERVICES.proximity.slice(0, 4).map(s =>
              renderDisplayServiceCard(s, '', 'border-slate-200 hover:border-primary')
            )}
          </div>
          {/* Deuxième ligne - 2 boutons centrés */}
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            {DISPLAY_SERVICES.proximity.slice(4).map(s =>
              renderDisplayServiceCard(s, '', 'border-slate-200 hover:border-primary')
            )}
          </div>
        </div>

        {/* Section: Services Professionnels - Identique à Auth.tsx */}
        <div>
          <h4 className="text-sm font-semibold text-[#04439e] mb-3 flex items-center justify-center gap-2">
            <span className="w-8 h-0.5 bg-[#04439e] rounded"></span>
            Services Professionnels
            <span className="w-8 h-0.5 bg-[#04439e] rounded"></span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DISPLAY_SERVICES.professional.map(s =>
              renderDisplayServiceCard(s, '', 'border-blue-200 hover:border-[#04439e]')
            )}
          </div>
        </div>

        {/* Section: Autres Services - Identique à Auth.tsx */}
        <div>
          <h4 className="text-sm font-semibold text-[#04439e] mb-3 flex items-center justify-center gap-2">
            <span className="w-8 h-0.5 bg-[#04439e] rounded"></span>
            Autres Services
            <span className="w-8 h-0.5 bg-[#04439e] rounded"></span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DISPLAY_SERVICES.other.map(s =>
              renderDisplayServiceCard(s, '', 'border-blue-200 hover:border-[#04439e]')
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );

  const renderConfigureForm = () => {
    const Icon = selectedType ? getServiceIcon(selectedType.code) : Store;

    return (
      <div className="space-y-6">
        {/* Selected type indicator */}
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{selectedType?.name}</h4>
            <p className="text-xs text-muted-foreground">{selectedType?.category}</p>
          </div>
          <CheckCircle className="w-5 h-5 text-[#ff4000] ml-auto" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">{t('addServiceModal.nomDeLEntreprise')}</Label>
            <Input
              id="business-name"
              placeholder="Ex: Mon Restaurant Gourmand"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              placeholder={t('addServiceModal.decrivezVotreActivite')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse (optionnel)</Label>
            <Input
              id="address"
              placeholder={t('addServiceModal.exKaloumConakryGuinee')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* GPS Location */}
          <div className="space-y-2">
            <Label>{t('addServiceModal.positionGpsRecommande')}</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={getGpsLocation}
                disabled={gpsLoading}
                className="gap-2"
              >
                {gpsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                {gpsLoading ? 'Localisation...' : 'Localiser mon service'}
              </Button>
              {latitude && longitude && (
                <div className="flex items-center gap-2 text-sm text-[#ff4000]">
                  <MapPin className="w-4 h-4" />
                  <span>{t('addServiceModal.positionEnregistree')}</span>
                </div>
              )}
            </div>
            {gpsError && (
              <p className="text-xs text-destructive">{gpsError}</p>
            )}
            {latitude && longitude && (
              <p className="text-xs text-muted-foreground">
                Coordonnées: {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </p>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Bon à savoir
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
              Vous pourrez personnaliser votre service avec des produits, menus, et horaires après la création.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1"
            disabled={creating}
          >
            Retour
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            className="flex-1 gap-2"
            disabled={creating || !businessName.trim()}
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Créer le service
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] lg:max-w-[900px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            {step === 'select' ? 'Nouveau service professionnel' : 'Configurer votre service'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {step === 'select'
              ? 'Choisissez le type de service que vous souhaitez créer parmi nos catégories'
              : `Configurez votre ${selectedType?.name || 'service'}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : step === 'select' ? (
            renderServiceTypeGrid()
          ) : (
            renderConfigureForm()
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddServiceModal;
