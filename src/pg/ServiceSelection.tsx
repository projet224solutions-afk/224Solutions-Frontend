import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ServiceSelectionCard } from '@/components/professional-services/ServiceSelectionCard';
import { ServiceSetupDialog } from '@/components/professional-services/ServiceSetupDialog';
import { useProfessionalServices } from '@/hooks/useProfessionalServices';
import type { ServiceType } from '@/hooks/useProfessionalServices';

export default function ServiceSelection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { serviceTypes, userServices, loading, createProfessionalService } = useProfessionalServices();
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [redirectChecked, setRedirectChecked] = useState(false);

  // Si l'utilisateur a déjà un service, rediriger vers son dashboard
  useEffect(() => {
    if (!loading && userServices.length > 0 && !redirectChecked) {
      setRedirectChecked(true);
      navigate(`/dashboard/service/${userServices[0].id}`, { replace: true });
    } else if (!loading) {
      setRedirectChecked(true);
    }
  }, [loading, userServices, navigate, redirectChecked]);

  // Grouper les services par catégorie
  const categories = [
    { value: 'all', label: 'Tous les services', count: serviceTypes.length },
    { value: 'services', label: 'Services', count: serviceTypes.filter(s => s.category === 'services').length },
    { value: 'commerce', label: 'Commerce', count: serviceTypes.filter(s => s.category === 'commerce').length },
    { value: 'transport', label: 'Transport', count: serviceTypes.filter(s => s.category === 'transport').length },
    { value: 'food', label: 'Restauration', count: serviceTypes.filter(s => s.category === 'food').length },
    { value: 'health', label: 'Santé', count: serviceTypes.filter(s => s.category === 'health').length },
    { value: 'education', label: 'Éducation', count: serviceTypes.filter(s => s.category === 'education').length },
    { value: 'tech', label: 'Technologie', count: serviceTypes.filter(s => s.category === 'tech').length },
    { value: 'creative', label: 'Créatif', count: serviceTypes.filter(s => s.category === 'creative').length },
  ].filter(cat => cat.count > 0 || cat.value === 'all');

  // Filtrer les services
  const filteredServices = serviceTypes.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleServiceSelect = (service: ServiceType) => {
    setSelectedService(service);
    setShowSetupDialog(true);
  };

  const handleCreateService = async (formData: any) => {
    if (!selectedService) return;

    const service = await createProfessionalService({
      service_type_id: selectedService.id,
      ...formData,
    });

    if (service) {
      // Rediriger vers le dashboard du service créé
      navigate(`/dashboard/service/${service.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t('serviceSelection.chargementDesServices')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header - opaque pour éviter le texte fantôme */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="gap-2 -ml-2"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>

          <div className="mt-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent leading-tight">
                Choisissez votre Service Professionnel
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto px-2">
              Sélectionnez le type de service que vous souhaitez créer.
              Chaque service dispose d'outils professionnels complets inspirés des meilleurs standards internationaux.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Barre de recherche */}
        <div className="max-w-2xl mx-auto mb-6">
          <Input
            type="search"
            placeholder={t('serviceSelection.rechercherUnService')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 text-sm sm:text-base"
          />
        </div>

        {/* Filtres par catégorie - scrollable horizontalement sur mobile */}
        <div className="mb-6 -mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  selectedCategory === category.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {category.label}
                <span className="ml-1 opacity-75">({category.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grille des services */}
        {filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">
              Aucun service trouvé pour "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredServices.map((service) => (
              <ServiceSelectionCard
                key={service.id}
                service={service}
                onSelect={() => handleServiceSelect(service)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog de configuration */}
      <ServiceSetupDialog
        open={showSetupDialog}
        onClose={() => setShowSetupDialog(false)}
        selectedService={selectedService}
        onSubmit={handleCreateService}
      />
    </div>
  );
}
