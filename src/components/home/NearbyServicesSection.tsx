/**
 * NEARBY SERVICES SECTION - Ultra Professional Design
 * 224Solutions - Premium Services Grid
 * Apple/Uber-inspired with modern glassmorphism
 * Fully translated + proximity location info
 */

import { Zap } from 'lucide-react';
import { HomeServiceCard } from './ServiceCard';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface ServiceStats {
  boutiques: number;
  taxi: number;
  livraison: number;
  restaurants: number;
}

interface NearbyServicesSectionProps {
  stats: ServiceStats;
  onServiceClick: (serviceId: string) => void;
  loading?: boolean;
  className?: string;
}

export function NearbyServicesSection({
  stats,
  onServiceClick,
  loading = false,
  className,
}: NearbyServicesSectionProps) {
  const { t } = useTranslation();

  const services = [
    {
      id: 'boutiques',
      icon: <img src="/service-icons/logo-boutique.jpeg" alt={t('proximity.svc.boutique.title')} className="w-8 h-8 object-cover rounded-lg" loading="lazy" />,
      title: t('home.shops'),
      subtitle: t('home.localShops'),
      count: stats.boutiques,
      gradient: 'bg-vendeur-primary/25',
      iconBg: 'bg-white/80',
      trending: stats.boutiques > 5,
    },
    {
      id: 'restaurants',
      icon: <img src="/service-icons/logo-resto.jpeg" alt="Restaurant" className="w-8 h-8 object-cover rounded-lg" loading="lazy" />,
      title: t('home.restaurant'),
      subtitle: t('home.orderFood'),
      count: stats.restaurants,
      gradient: '',
      iconBg: 'bg-white/80',
      trending: stats.restaurants > 0,
    },
    {
      id: 'taxi',
      icon: <img src="/service-icons/icon-taxi-moto.png" alt="Taxi" className="w-8 h-8 object-cover rounded-lg" loading="lazy" />,
      title: t('home.taxiMotos'),
      subtitle: t('home.fastTransport'),
      count: stats.taxi,
      gradient: 'bg-taxi-primary/25',
      iconBg: 'bg-white/80',
      trending: stats.taxi > 2,
    },
    {
      id: 'livraison',
      icon: <img src="/service-icons/icon-livreur.png" alt="Livreur" className="w-8 h-8 object-cover rounded-lg" loading="lazy" />,
      title: t('home.delivery'),
      subtitle: t('home.expressDelivery'),
      count: stats.livraison,
      gradient: 'bg-livreur-primary/25',
      iconBg: 'bg-white/80',
      trending: stats.livraison > 1,
    },
  ];

  return (
    <section className={cn('px-4 py-6 md:px-6', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
              {t('home.nearbyServices')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('home.findServicesNearby')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff4000] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff4000]"></span>
          </span>
          <span className="text-[11px] font-medium text-[#ff4000] dark:text-[#ff4000]">
            {t('home.live')}
          </span>
        </div>
      </div>

      {/* Skeleton pendant le chargement des stats (plus de "0" affiché) */}
      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Services Grid - 2x2 Layout */}
      {!loading && (
      <div className="grid grid-cols-2 gap-3">
        {services.map((service, index) => (
          <div
            key={service.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <HomeServiceCard
              id={service.id}
              icon={service.icon}
              title={service.title}
              subtitle={service.subtitle}
              count={service.count}
              gradient={service.gradient}
              iconBg={service.iconBg}
              trending={service.trending}
              onClick={() => onServiceClick(service.id)}
              compact
            />
          </div>
        ))}
      </div>
      )}
    </section>
  );
}

export default NearbyServicesSection;
