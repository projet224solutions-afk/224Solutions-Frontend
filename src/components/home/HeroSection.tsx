/**
 * HERO SECTION - Ultra Compact E-Commerce Design
 * 224Solutions - Premium Mobile-First Hero
 * Inspired by Uber, Deliveroo, Glovo
 */

import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Utensils, Truck, Car, ChevronRight, Package, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { AvailableServicesModal } from '@/components/professional-services/AvailableServicesModal';

interface QuickAction {
  id: string;
  icon: ReactNode;
  label: string;
  gradient: string;
}

const getQuickActions = (t: (key: string) => string): QuickAction[] => [
  {
    id: 'restaurant',
    icon: <Utensils className="w-5 h-5" />,
    label: t('home.restaurant'),
    gradient: 'bg-vendeur-secondary'
  },
  {
    id: 'boutique',
    icon: <Store className="w-5 h-5" />,
    label: t('home.boutique'),
    gradient: ''
  },
  {
    id: 'livraison',
    icon: <Truck className="w-5 h-5" />,
    label: t('home.delivery'),
    gradient: ''
  },
  {
    id: 'transport',
    icon: <Car className="w-5 h-5" />,
    label: t('home.transport'),
    gradient: ''
  },
];

interface HeroSectionProps {
  className?: string;
}

export function HeroSection({ className }: HeroSectionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const _quickActions = getQuickActions(t);

  const [showServicesModal, setShowServicesModal] = useState(false);

  const handleStartNowClick = () => {
    if (user) {
      // User is logged in - show available services modal
      setShowServicesModal(true);
    } else {
      // User is not logged in - navigate to auth page
      navigate('/auth');
    }
  };

  const _handleQuickActionClick = (_actionId: string) => {
    if (user) {
      // User is logged in - show available services modal
      setShowServicesModal(true);
    } else {
      // User is not logged in - navigate to auth page
      navigate('/auth');
    }
  };

  return (
    <section className={cn('relative', className)}>
      {/* Compact Header */}
      <div className="relative z-10 px-4 pt-6 pb-8 md:pt-8 md:pb-10">
        {/* Welcome Badge */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 rounded-full border border-primary/15">
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">224Solutions</span>
          </div>
        </div>

        {/* Main Title - Compact */}
        <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-2">
          {t('home.createService')}
        </h1>

        {/* Subtitle - Short */}
        <p className="text-sm md:text-base text-muted-foreground mb-6">
          {t('home.professionalCategories')} • {t('home.completeTools') || t('home.withCompleteTools')}
        </p>

        {/* CTA Buttons - Différent selon si l'utilisateur est connecté ou non */}
        {user ? (
          <>
            {/* Bouton Créer un service - pour utilisateur connecté */}
            <Button
              onClick={handleStartNowClick}
              size="lg"
              className={cn(
                'w-full gap-2 h-12 rounded-xl text-base font-semibold',
                'bg-accent hover:bg-accent/90 text-accent-foreground',
                'shadow-lg shadow-accent/30',
                'active:scale-[0.98] transition-all duration-200'
              )}
            >
              {t('home.createService') || 'Créer un service'}
            </Button>
          </>
        ) : (
          <>
            {/* Bouton Commencer - pour utilisateur non connecté */}
            <Button
              onClick={handleStartNowClick}
              size="lg"
              className={cn(
                'w-full gap-2 h-12 rounded-xl text-base font-semibold',
                'bg-accent hover:bg-accent/90 text-accent-foreground',
                'shadow-lg shadow-accent/30',
                'active:scale-[0.98] transition-all duration-200'
              )}
            >
              <Store className="w-5 h-5" />
              {t('home.startNow')}
            </Button>
          </>
        )}

        {/* Digital Products & Formation Button - toujours visible */}
        <Button
          onClick={() => navigate('/digital-products')}
          variant="outline"
          size="lg"
          className={cn(
            'w-full gap-2 h-11 rounded-xl text-base font-medium mt-3',
            'border-primary/25 text-primary bg-primary/5',
            'hover:bg-primary/10 hover:border-primary/50',
            'active:scale-[0.98] transition-all duration-200'
          )}
        >
          <GraduationCap className="w-5 h-5" />
          {t('home.digitalProducts') || 'Formation & Produits numériques'}
        </Button>
      </div>


      {/* Available Services Modal - Only shown when user is logged in */}
      <AvailableServicesModal
        open={showServicesModal}
        onOpenChange={setShowServicesModal}
      />
    </section>
  );
}

export default HeroSection;
