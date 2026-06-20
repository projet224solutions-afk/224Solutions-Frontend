/**
 * Modal for displaying available service TYPES
 * When user is logged in and clicks "Commencer maintenant"
 * Shows available service types (Boutique, Restaurant, Salon, etc.) to create
 */

import { useState, useEffect } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Search,
  Sparkles,
  Store,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getServiceVisual } from '@/config/serviceVisuals';

interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  is_active: boolean;
  services_count?: number;
}

interface AvailableServicesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvailableServicesModal({ open, onOpenChange }: AvailableServicesModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchServiceTypes();
    }
  }, [open]);

  const fetchServiceTypes = async () => {
    setLoading(true);
    try {
      // Fetch service types with count of active services
      const { data, error } = await supabase
        .from('service_types')
        .select('id, code, name, description, icon, category, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Get count of services for each type
      const typesWithCount = await Promise.all(
        (data || []).map(async (type) => {
          const { count } = await supabase
            .from('professional_services')
            .select('id', { count: 'exact', head: true })
            .eq('service_type_id', type.id)
            .eq('status', 'active');

          return { ...type, services_count: count || 0 };
        })
      );

      setServiceTypes(typesWithCount);
    } catch (error) {
      console.error('Error fetching service types:', error);
      toast.error(t('availableServicesModal.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const filteredServiceTypes = serviceTypes.filter(type =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleServiceTypeClick = (serviceType: ServiceType) => {
    setSelectedServiceType(serviceType);
    setShowCreateForm(true);
    setNewEmail('');
    setEmailError('');
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'L\'email est requis';
    }
    if (!emailRegex.test(email)) {
      return 'Email invalide';
    }
    if (user?.email && email.toLowerCase() === user.email.toLowerCase()) {
      return 'Vous devez utiliser un email différent de votre compte actuel';
    }
    return '';
  };

  const handleEmailSubmit = async () => {
    const error = validateEmail(newEmail);
    if (error) {
      setEmailError(error);
      return;
    }

    setIsSubmitting(true);
    try {
      // Store the new email and selected service type in sessionStorage
      sessionStorage.setItem('service_creation_email', newEmail);
      if (selectedServiceType) {
        sessionStorage.setItem('selected_service_type_id', selectedServiceType.id);
        sessionStorage.setItem('selected_service_type_name', selectedServiceType.name);
      }

      toast.success(t('availableServicesModal.emailEnregistreVousAllezEtre'));
      onOpenChange(false);

      // Navigate to service selection with the pre-selected service type
      navigate('/service-selection', {
        state: {
          serviceEmail: newEmail,
          selectedServiceTypeId: selectedServiceType?.id,
          fromServicesModal: true
        }
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('availableServicesModal.uneErreurEstSurvenue'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToList = () => {
    setShowCreateForm(false);
    setSelectedServiceType(null);
    setNewEmail('');
    setEmailError('');
  };

  const renderEmptyState = () => (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Store className="w-8 h-8 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-2">
        Aucun type de service disponible
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
        Les types de services seront bientôt disponibles. Revenez plus tard !
      </p>
    </div>
  );

  const renderCreateForm = () => (
    <div className="space-y-6">
      <div className="text-center">
        {selectedServiceType && (
          (() => {
            const visual = getServiceVisual({
              code: selectedServiceType.code,
              name: selectedServiceType.name,
              category: selectedServiceType.category,
            });
            const Icon = visual.icon;

            return (
              <div
                className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center overflow-hidden mx-auto mb-4',
                )}
                style={{ backgroundColor: visual.logoImage ? undefined : visual.accent }}
              >
                {visual.logoImage ? (
                  <img src={visual.logoImage} alt={selectedServiceType.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Icon className="w-6 h-6 text-white" />
                )}
              </div>
            );
          })()
        )}
        <h3 className="font-semibold text-foreground mb-2">
          Créer votre {selectedServiceType?.name || 'service'}
        </h3>
        <p className="text-sm text-muted-foreground">
          Pour créer votre service, vous devez utiliser une adresse email différente de celle de votre compte actuel.
        </p>
      </div>

      <div className="bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-[#ff4000] shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-[#ff4000] dark:text-orange-200 mb-1">
              Pourquoi un email différent ?
            </p>
            <p className="text-[#ff4000] dark:text-orange-300">
              Cette séparation permet de mieux gérer votre activité professionnelle et de protéger votre compte personnel.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-email">{t('availableServicesModal.emailPourVotreServiceProfessionnel')}</Label>
        <Input
          id="service-email"
          type="email"
          placeholder={t('availableServicesModal.votreServiceExempleCom')}
          value={newEmail}
          onChange={(e) => {
            setNewEmail(e.target.value);
            if (emailError) setEmailError('');
          }}
          className={cn(emailError && 'border-destructive')}
        />
        {emailError && (
          <p className="text-sm text-destructive">{emailError}</p>
        )}
        {user?.email && (
          <p className="text-xs text-muted-foreground">
            Votre email actuel : {user.email}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleBackToList}
          className="flex-1"
          disabled={isSubmitting}
        >
          Retour
        </Button>
        <Button
          onClick={handleEmailSubmit}
          className="flex-1 gap-2"
          disabled={isSubmitting || !newEmail}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          Continuer
        </Button>
      </div>
    </div>
  );

  const renderServiceTypesList = () => (
    <div className="space-y-3">
      {/* Search bar - compact on mobile */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('availableServicesModal.rechercherUnTypeDeService')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 text-sm"
        />
      </div>

      {/* Service types grid - optimized for mobile & landscape */}
      <div className="max-h-[55vh] overflow-y-auto pr-1 -mx-1 px-1">
        {filteredServiceTypes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Aucun service trouvé pour "{searchQuery}"
          </div>
        ) : (
          <div className="grid grid-cols-2 landscape:grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredServiceTypes.map((serviceType) => (
              (() => {
                const visual = getServiceVisual({
                  code: serviceType.code,
                  name: serviceType.name,
                  category: serviceType.category,
                });
                const Icon = visual.icon;

                return (
              <Card
                key={serviceType.id}
                className={cn(
                  'cursor-pointer transition-all duration-200 group',
                  'hover:border-primary/50 hover:shadow-lg hover:scale-[1.02]',
                  'border-2 border-transparent bg-gradient-to-br from-card to-muted/30 overflow-hidden'
                )}
                onClick={() => handleServiceTypeClick(serviceType)}
              >
                <div className="relative h-24 overflow-hidden border-b border-border/50">
                  <img
                    src={visual.image}
                    alt={serviceType.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                  <div
                    className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-lg"
                    style={{ backgroundColor: visual.logoImage ? undefined : visual.accent }}
                  >
                    {visual.logoImage ? (
                      <img src={visual.logoImage} alt={serviceType.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>
                <CardContent className="p-2.5 sm:p-4">
                  <div className="flex flex-col items-center text-center gap-2">
                    {/* Content - compact on mobile */}
                    <div className="space-y-0.5 sm:space-y-1 min-w-0 w-full">
                      <h4 className="font-semibold text-foreground text-xs sm:text-sm leading-tight line-clamp-2">
                        {serviceType.name}
                      </h4>
                      {serviceType.category && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] sm:text-xs capitalize px-1.5 py-0"
                        >
                          {serviceType.category}
                        </Badge>
                      )}
                      {serviceType.description && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 mt-0.5 hidden xs:block">
                          {serviceType.description}
                        </p>
                      )}
                      {(serviceType.services_count ?? 0) > 0 && (
                        <p className="text-[10px] sm:text-xs text-primary font-medium">
                          {serviceType.services_count} actif{(serviceType.services_count ?? 0) > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden p-3 sm:p-6">
        <DialogHeader className="pb-2 sm:pb-4">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shadow-md">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="truncate">
              {showCreateForm ? `Créer: ${selectedServiceType?.name}` : 'Services disponibles'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {showCreateForm
              ? 'Configurez votre nouveau service professionnel'
              : 'Choisissez le type de service que vous souhaitez créer'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Chargement...</p>
              </div>
            </div>
          ) : showCreateForm ? (
            renderCreateForm()
          ) : serviceTypes.length === 0 ? (
            renderEmptyState()
          ) : (
            renderServiceTypesList()
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
