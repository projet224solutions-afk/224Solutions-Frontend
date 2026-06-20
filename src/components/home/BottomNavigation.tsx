/**
 * BOTTOM NAVIGATION - Ultra Professional Design
 * 224Solutions - Apple/Uber-style Navigation
 * Floating design with blur effects - Fully translated
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, MapPin, User, ShoppingCart, LucideIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  icon: LucideIcon;
  labelKey: string;
  path: string | (() => string);
}

interface BottomNavigationProps {
  className?: string;
}

export function BottomNavigation({ className }: BottomNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    { id: 'home', icon: Home, labelKey: 'nav.home', path: '/home' },
    { id: 'marketplace', icon: ShoppingBag, labelKey: 'nav.marketplace', path: '/marketplace' },
    { id: 'my-purchases', icon: ShoppingCart, labelKey: 'nav.myPurchases', path: '/my-purchases' },
    { id: 'tracking', icon: MapPin, labelKey: 'nav.tracking', path: '/tracking' },
    { id: 'profil', icon: User, labelKey: 'nav.profile', path: '/profil' },
  ];

  const isActive = (path: string | (() => string)) => {
    const actualPath = typeof path === 'function' ? path() : path;
    return location.pathname.startsWith(actualPath);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'pb-safe',
        className
      )}
    >
      {/* Subtle top gradient for seamless blend */}
      <div className="absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      {/* Navigation Bar - Clean iOS style */}
      <div
        className={cn(
          'relative',
          'bg-card backdrop-blur-2xl',
          'border-t border-border/40',
          'shadow-[0_-1px_12px_hsl(0_0%_0%_/_0.04)]'
        )}
      >
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const itemPath = typeof item.path === 'function' ? item.path() : item.path;
            const active = isActive(item.path);

            return (
              <button
                key={item.id}
                onClick={() => navigate(itemPath)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-2 px-1.5 mx-1 my-1 rounded-xl no-hover-effect',
                  'transition-all duration-200',
                  active
                    ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20 scale-[1.02]'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-95'
                )}
              >
                {/* Icon */}
                <div className={cn('relative p-1 rounded-full transition-all duration-200', active && 'bg-white/15')}>
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-transform duration-200',
                      active && 'scale-110'
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  {/* Active dot indicator */}
                  {active && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/90 rounded-full" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[11px] font-medium mt-0.5',
                    active ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {t(item.labelKey)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Safe area spacer for iOS */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </nav>
  );
}

export default BottomNavigation;
